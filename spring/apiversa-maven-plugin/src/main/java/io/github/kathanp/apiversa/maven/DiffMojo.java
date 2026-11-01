package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.ApiversaException;
import java.io.File;
import java.nio.file.Files;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Prints each change between two dates and the canonical body after it. `--out` is the only file write. */
@Mojo(name = "diff", requiresProject = true)
public class DiffMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.schema", required = true)
    private String schema;

    @Parameter(property = "apiversa.from", required = true)
    private String from;

    @Parameter(property = "apiversa.to")
    private String to;

    @Parameter(property = "apiversa.body", required = true)
    private File body;

    @Parameter(property = "apiversa.today")
    private String today;

    @Parameter(property = "apiversa.out")
    private File out;

    @Override
    public void execute() throws MojoFailureException {
        try {
            String text = PluginGoals.diff(dir.toPath(), schema, from, to, Files.readString(body.toPath()), today);
            getLog().info(text);
            if (out != null && !text.isEmpty()) {
                int space = text.lastIndexOf('\n');
                String last = space < 0 ? text : text.substring(space + 1);
                int split = last.indexOf(' ');
                Files.writeString(out.toPath(), split < 0 ? last : last.substring(split + 1));
            }
        } catch (ApiversaException exception) {
            throw new MojoFailureException(exception.code(), exception);
        } catch (RuntimeException exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
