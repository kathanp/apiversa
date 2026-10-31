package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Prints each version and the description of its change files. */
@Mojo(name = "changelog", requiresProject = true)
public class ChangelogMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.today")
    private String today;

    @Override
    public void execute() throws MojoFailureException {
        try {
            getLog().info(PluginGoals.changelog(dir.toPath(), today));
        } catch (RuntimeException exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
