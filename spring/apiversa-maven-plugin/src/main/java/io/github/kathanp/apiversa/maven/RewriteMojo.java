package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** `mvn apiversa:rewrite` writes each JSONL line in another version. */
@Mojo(name = "rewrite", requiresProject = true)
public class RewriteMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/api-versions")
    private File dir;

    @Parameter(property = "apiversa.schema", required = true)
    private String schema;

    @Parameter(property = "apiversa.direction", required = true)
    private String direction;

    @Parameter(property = "apiversa.version", required = true)
    private String version;

    @Parameter(property = "apiversa.in", required = true)
    private File in;

    @Parameter(property = "apiversa.out", required = true)
    private File out;

    @Override
    public void execute() throws MojoFailureException {
        try {
            if (!"up".equals(direction) && !"down".equals(direction)) throw new MojoFailureException("direction must be up or down");
            Rewrite.Result result = Rewrite.rewrite(dir.toPath(), schema, direction, version, in.toPath(), out.toPath());
            if (!result.ok()) throw new MojoFailureException(Rewrite.failure(result));
        } catch (MojoFailureException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
