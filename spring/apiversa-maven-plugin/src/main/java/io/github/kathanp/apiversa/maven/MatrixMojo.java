package io.github.kathanp.apiversa.maven;

import java.io.File;
import java.nio.file.Files;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Writes upgrade-matrix.json. Nothing is sent. */
@Mojo(name = "matrix", requiresProject = true)
public class MatrixMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.today")
    private String today;

    @Parameter(property = "apiversa.out")
    private File out;

    @Override
    public void execute() throws MojoFailureException {
        try {
            String text = PluginGoals.matrix(dir.toPath(), today);
            File target = out == null ? new File("upgrade-matrix.json") : out;
            Files.writeString(target.toPath(), text + "\n");
            getLog().info(target.getPath());
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
